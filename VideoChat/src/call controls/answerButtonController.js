import { callInput, camera, hangUp } from "../controls";

export const answerButtonController = async (
  pc,
  firestore,
  localStream,
  remoteStream
) => {
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
