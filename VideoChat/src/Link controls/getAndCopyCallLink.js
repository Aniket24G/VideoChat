import { callInput, callLink, copyLink } from "../controls"

let generatedCallLink = "";
export const getCallLink = () => {
    const callId = callInput.value;

    generatedCallLink = `${window.location.origin}/?callId=${callId}`;
    callLink.value = generatedCallLink;
    callLink.hidden = false;
    copyLink.hidden = false;
}

export const copyCallLink = () => {
    navigator.clipboard
    .writeText(generatedCallLink)
    .then(() => alert("link copied to clipboard"))
    .catch((e) => alert('failed to copy',e))
}