import "./style.css";
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import {
  localCamButton,
  localVideo,
  callButton,
  callInput,
  answerButton,
  hangUp,
  remoteVideo,
  getLink,
  copyLink,
  callLink,
  camera,
  mic,
} from "./controls";
import { firebaseConfig } from "./config";
import { server } from "./servers";
import { getCallLink, copyCallLink } from "./Link controls/getAndCopyCallLink";
import {
  cameraController,
  micController,
} from "./call controls/mediaController";
import { callButtonController } from "./call controls/callButtonController";
import { answerButtonController } from "./call controls/answerButtonController";

document.addEventListener("DOMContentLoaded", () => {
  // Initialize Firebase
  const app = firebase.initializeApp(firebaseConfig);
  const firestore = firebase.firestore();

  //extract callid from url
  const url = new URLSearchParams(window.location.search);
  const callIdFromURL = url.get("callId");

  if (callIdFromURL) {
    callInput.value = callIdFromURL;
    alert("click answer to join the call");
  }

  //global state to manage peer connection
  let pc = new RTCPeerConnection(server);
  let localStream = null;
  let remoteStream = null;

  //Call Link controls
  getLink.onclick = () => getCallLink();
  copyLink.onclick = () => copyCallLink();

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
    if (remoteVideo) {
      remoteVideo.srcObject = remoteStream;
    } else {
      console.error("Cannot get remote video");
    }
  };

  //cretae a call offer
  callButton.onclick = () => callButtonController(pc, firestore);

  //answering the call
  answerButton.onclick = () =>
    answerButtonController(pc, firestore, localStream, remoteStream);

  //Camera and mic controller
  camera.onclick = () => cameraController(localStream);
  mic.onclick = () => micController(localStream);

  //data channel to broadcast hangup changes to other peer
  let dataChannel = null;
  const setDataChannel = () => {
    dataChannel = pc.createDataChannel("hangup");
    dataChannel.onopen = () => console.log("data channel opened");
    dataChannel.onclose = () => console.log("data channel closed");
    dataChannel.onerror = (error) => console.log("Data channel error: ", error);

    dataChannel.onmessage = (event) => {
      if (event.data === "hangup") {
        console.log("received hang up msg");
        resetCallState();
        pc.close();
      }
    };

    pc.ondatachannel = (event) => {
      dataChannel = event.channel;
      dataChannel.onopen = () => console.log("data channel opened");
      dataChannel.onclose = () => console.log("data channel closed");
      dataChannel.onerror = (error) =>
        console.log("Data channel error: ", error);

      dataChannel.onmessage = (event) => {
        if (event.data === "hangup") {
          console.log("received hang up msg");
          resetCallState();
          pc.close();
        }
      };
    };
  };
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
  };

  hangUp.onclick = async () => {
    if (dataChannel && dataChannel.readyState === "open") {
      dataChannel.send("hangup");
      console.log("call disconnected");
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

    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.close();
      console.log("peer connection closed");
    }
    // pc.close();
    pc = new RTCPeerConnection(server);
  };
});
