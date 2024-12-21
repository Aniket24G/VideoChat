import { camera, mic } from "../controls";

export const cameraController = (localStream) => {
  const videoTrack = localStream.getVideoTracks()[0];
  videoTrack.enabled = !videoTrack.enabled;
  camera.style.backgroundColor = videoTrack.enabled ? "#ff7b00" : "#e84824";
};

export const micController = (localStream) => {
  const audioTrack = localStream.getAudioTracks()[0];
  audioTrack.enabled = !audioTrack.enabled;
  mic.style.backgroundColor = audioTrack.enabled ? "#ff7b00" : "#e84824";
};
