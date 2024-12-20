// Import the functions you need from the SDKs you need
// import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries
import "./style.css";
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";

document.addEventListener("DOMContentLoaded", () => {
  //get all the buttons and inputs
  const localCamButton = document.getElementById("localCamButton");
  const localVideo = document.getElementById("localCamVideo");
  const callButton = document.getElementById("callButton");
  const callInput = document.getElementById("callInput");
  const answerButton = document.getElementById("answerButton");
  const hangUp = document.getElementById("hangUp");
  const remoteVideo = document.getElementById("remoteCamVideo");
  const getLink = document.getElementById("getLink");
  const copyLink = document.getElementById("copyLink");
  const callLink = document.getElementById("callLink");
  const camera = document.getElementById("cameraButton");
  const mic = document.getElementById("micButton");

  //extract callid from url
  const url = new URLSearchParams(window.location.search);
  const callIdFromURL = url.get("callId");

  if (callIdFromURL) {
    callInput.value = callIdFromURL;
    alert("click answer to join the call");
  }

  // Your web app's Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyCj7JsPCcmjOWPbOf7YBkMIxWALVbeavlk",
    authDomain: "fir-rtc-e95f1.firebaseapp.com",
    projectId: "fir-rtc-e95f1",
    storageBucket: "fir-rtc-e95f1.firebasestorage.app",
    messagingSenderId: "907537767246",
    appId: "1:907537767246:web:520782016fc25297d1dc1f",
  };

  // Initialize Firebase
  const app = firebase.initializeApp(firebaseConfig);
  const firestore = firebase.firestore();

  //stun servers
  const server = {
    iceServers: [
      {
        urls: [
          "stun:stun1.l.google.com:19302",
          "stun:stun2.l.google.com:19302",
        ],
      },
    ],
    iceCandidatePoolSize: 10,
  };

  //global state to manage peer connection
  let pc = new RTCPeerConnection(server);
  let localStream = null;
  let remoteStream = null;

  //generate and copy calll link
  let generatedCallLink = "";
  getLink.onclick = () => {
    const callId = callInput.value;

    generatedCallLink = `${window.location.origin}/?callId=${callId}`;
    console.log(generatedCallLink);
    callLink.value = generatedCallLink;
    callLink.hidden = false;
    copyLink.hidden = false;

    // getLink.innerHTML = "Copy link"
  };

  copyLink.onclick = () => {
    navigator.clipboard
      .writeText(generatedCallLink)
      .then(() => alert("Link copied to clipboard"))
      .catch(() => alert("failed to copy the link"));
  };

  //set up local media sources
  localCamButton.onclick = async () => {
    localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });
    remoteStream = new MediaStream();

    //push local stream to peer connection
    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });

    if (localVideo) {
      localVideo.srcObject = localStream;
    } else {
      console.error("Cannot get local video");
    }

    // pull tracks from the remote stream and add to to video stream
    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        remoteStream.addTrack(track);
      });
    };

    //adding the streams to the video elements in DOM
    if(remoteVideo){
      remoteVideo.srcObject = remoteStream;
    }else{
      console.error('Cannot get remote video');
    }
  };

  //create an call offer
  callButton.onclick = async () => {
    // remoteStream = new MediaStream();

    //reference firestore collection
    const callDoc = firestore.collection("calls").doc();
    const offerCandidates = callDoc.collection("offerCandidates");
    const answerCandidates = callDoc.collection("answerCandidates");

    callInput.value = callDoc.id;

    const callId = callDoc.id;
    callInput.value = callId;

    //get candidates for the caller, save to db, handle ice candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        // console.log("Offer ICE candidate",event.candidate);
        offerCandidates.add(event.candidate.toJSON());
      }
    };

    //handle the remote video
    // pc.ontrack = (event) => {
    //   event.streams[0].getTracks().forEach((track) => {
    //     remoteStream.addTrack(track);
    //   });

    //   if (remoteVideo) {
    //     remoteVideo.srcObject = remoteStream;
    //   } else {
    //     console.error("error in remote video");
    //   }
    // };

    //create an offer
    const offerDesc = await pc.createOffer();
    await pc.setLocalDescription(offerDesc);

    const offer = {
      //sdp = session desc protocol
      sdp: offerDesc.sdp,
      type: offerDesc.type,
    };

    await callDoc.set({ offer });

    //listen for answer from db
    callDoc.onSnapshot((snapshot) => {
      const data = snapshot.data();
      if (!pc.currentRemoteDescription && data?.answer) {
        const answerDesc = new RTCSessionDescription(data.answer);
        pc.setRemoteDescription(answerDesc);
      }
    });

    //when call is answered add candidate to the peer connection
    answerCandidates.onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        console.log("snapshot ice candidates", change.doc.data());
        if (change.type === "added") {
          const candidate = new RTCIceCandidate(change.doc.data());
          pc.addIceCandidate(candidate);
        }
      });
    });
    hangUp.disabled = false;
    getLink.hidden = false;
  };

  //asnwering the call
  answerButton.onclick = async () => {
    const callId = callInput.value;
    const callDoc = firestore.collection("calls").doc(callId);
    const answerCandidates = callDoc.collection("answerCandidates");
    const offerCandidates = callDoc.collection("offerCandidates");

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        // console.log("Answer ice candidate",event.candidate);
        answerCandidates.add(event.candidate.toJSON());
      }
    };

    //handle local stream for answerer
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        if (!pc.getSenders().find((sender) => sender.track === track)) {
          pc.addTrack(track, localStream);
        }
      });
    } else {
      console.error("local video not found");
    }

    const callData = (await callDoc.get()).data();
    const offerDesc = callData.offer;
    // console.log("Offer desc",offerDesc);
    await pc.setRemoteDescription(new RTCSessionDescription(offerDesc));

    const answerDesc = await pc.createAnswer();
    await pc.setLocalDescription(answerDesc);

    const answer = {
      type: answerDesc.type,
      sdp: answerDesc.sdp,
    };

    await callDoc.update({ answer });

    offerCandidates.onSnapshot((snapshot) => {
      snapshot.docChanges().forEach((change) => {
        // console.log(change);
        if (change.type === "added") {
          let data = change.doc.data();
          pc.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });

    remoteStream = new MediaStream();

    // handle remote stream for answerer
    pc.ontrack = (event) => {
      if (!remoteStream) {
        remoteStream = new MediaStream();
      }

      event.streams[0].forEach((track) => {
        if (!remoteStream.getTracks().includes(track)) {
          remoteStream.addTrack(track);
        }
      });

      if (remoteVideo) {
        remoteVideo.srcObject = remoteStream;
      }
    };
    console.log("call connected");
    hangUp.disabled = false;
    camera.disabled = false;
    mic.disabled = false;
  };

  //camera and mic Button
  camera.onclick = () => {
    const videoTrack = localStream.getVideoTracks()[0];
    videoTrack.enabled = !videoTrack.enabled;
    camera.textContent = videoTrack.enabled ? "Turn Cam off" : "Turn Cam on";
  };

  mic.onclick = () => {
    const audioTrack = localStream.getAudioTracks()[0];
    audioTrack.enabled = !audioTrack.enabled;
    mic.textContent = audioTrack.enabled ? "Turn Mic on" : "Turn Mic off";
  };

  //data channel to broadcast hangup changes to other peer
  let dataChannel = null;
  const setDataChannel = () => {
    dataChannel = pc.createDataChannel("hangup");
    dataChannel.onopen = () => console.log("data channel opened");
    dataChannel.onclose = () => console.log("data channel closed");
    dataChannel.onerror = (error) => console.log("Data channel error: ", error)

    dataChannel.onmessage = (event) => {
      if(event.data === "hangup"){
        console.log("received hang up msg");
        resetCallState();
        pc.close();
      }
    }

    pc.ondatachannel = (event) => {
      dataChannel = event.channel;
      dataChannel.onopen = () => console.log("data channel opened");
    dataChannel.onclose = () => console.log("data channel closed");
    dataChannel.onerror = (error) => console.log("Data channel error: ", error)

    dataChannel.onmessage = (event) => {
      if(event.data === "hangup"){
        console.log("received hang up msg");
        resetCallState();
        pc.close();
      }
    }
    }
    
    
  }
  const resetCallState = () => {
    callInput.value = "";
    remoteVideo.srcObject = null;
    getLink.hidden = true;
    callLink.value = "";
    callLink.hidden = true;
    copyLink.hidden = true;
    hangUp.disabled = true;
    camera.disabled = true;
    mic.disabled = true;

    //change the url without relocading the page
    const url = new URL(window.location);
    url.searchParams.delete("callId");
    window.history.replaceState({}, document.title, url.toString());
  }

  hangUp.onclick = async () => {

    if(dataChannel &&  dataChannel.readyState === 'open'){
      dataChannel.send('hangup');
      console.log('call disconnected');
      
    }
    resetCallState();

    const callId = callInput.value;

    if (!callId) {
      // console.log('No active session');
      return;
    }

    const callDoc = firestore.collection("calls").doc(callId);
    const offerCandidates = callDoc.collection("offerCandidates");
    const answerCandidates = callDoc.collection("answerCandidates");

    

    const deleteSubCollections = async (subcollection) => {
      const snapshot = await subcollection.get();
      const batch = firestore.batch();
      snapshot.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
    };

    try {
      await deleteSubCollections(offerCandidates);
      await deleteSubCollections(answerCandidates), await callDoc.delete();
    } catch (e) {
      console.log(e);
    }


    if(pc){
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.close();
      console.log('peer connection closed');
      
    }
    // pc.close();
    pc = new RTCPeerConnection(server);

    // callIdFromURL = "";
    // callInput.value = "";
    // remoteVideo.srcObject = null;
    // getLink.hidden = true;
    // callLink.value = "";
    // callLink.hidden = true;
    // copyLink.hidden = true;
    // hangUp.disabled = true;
    // camera.disabled = true;
    // mic.disabled = true;
  };
});
