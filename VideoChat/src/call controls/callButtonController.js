import { callInput, getLink, hangUp } from "../controls";

export const callButtonController = async (pc, firestore) => {
  const callDoc = firestore.collection("calls").doc();
  const offerCandidates = callDoc.collection("offerCandidates");
  const answerCandidates = callDoc.collection("answerCandidates");

  const callId = callDoc.id;
  callInput.value = callId;

  //get candidates for caller, save to db, handle ice candidates
  pc.onicecandidate = (event) => {
    if (event.candidate) offerCandidates.add(event.candidate.toJSON());
  };

  //create an offer
  const offerDesc = await pc.createOffer();
  await pc.setLocalDescription(offerDesc);

  const offer = {
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
      if (change.type === "added") {
        const candidate = new RTCIceCandidate(change.doc.data());
        pc.addIceCandidate(candidate);
      }
    });
  });
  hangUp.disabled = false;
  getLink.hidden = false;
};
