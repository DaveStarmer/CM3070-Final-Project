/**
 * Create activation card and append to main
 * @param {object} props props object
 * @param {string} props.videoStill uri of video still
 * @param {string} props.activationTimestamp timestamp of activation
 * @param {string} props.camera camera details
 */
function addNotificationToMain(props) {
  document.querySelector("main").appendChild(createNotification(props))
}

/**
 * Create activation card
 * @param {object} props props object
 * @param {string} props.videoStill uri of video still
 * @param {string} props.timestamp timestamp of activation
 * @param {string} props.camera camera details
 * @returns DOM object
 */
function createNotification(props) {
  /** outer card */
  const card = document.createElement("div")
  card.classList.add("activation-card")
  /** video still image */
  const videoStill = document.createElement("img")
  videoStill.src = props.videoStill
  card.appendChild(videoStill)
  /** information area */
  const info = document.createElement("div")
  info.classList.add("activation-info")
  card.appendChild(info)
  /** timestamp text */
  const actDT = document.createElement("p")
  actDT.classList.add("activation-date-time")
  actDT.innerText = props.timestamp
  info.appendChild(actDT)
  /** camera text */
  const actCam = document.createElement("p")
  actCam.innerText = props.camera
  info.appendChild(actCam)

  return card
}

addNotificationToMain({ videoStill: "https://placehold.co/150x75", timestamp: "19/02/2025 08:30", camera: "Test Camera (Camera 1)" })

addNotificationToMain({ videoStill: "https://placehold.co/150x75", timestamp: "20/02/2025 19:00", camera: "Other  Test Camera (Camera 2)" })