from datetime import datetime
import cv2
from movement_detection import MovementDetection

VIDEO_LENGTH = 20
FRAME_HEIGHT = 480
FRAME_WIDTH = 640
FRAME_RATE = 15
BUFFER_TIME = 2

def start_camera():
    camera = cv2.VideoCapture(0, cv2.CAP_V4L)

    if camera.isOpened():
        print("Camera started")
    else:
        print("Camera not started")
        quit()

    # set camera up
    camera.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_WIDTH)
    camera.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_HEIGHT)
    camera.set(cv2.CAP_PROP_FPS, FRAME_RATE)

    # get values from camera
    frame_height = int(camera.get(cv2.CAP_PROP_FRAME_HEIGHT))
    frame_width = int(camera.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_shape = (frame_width, frame_height)
    frame_rate = camera.get(cv2.CAP_PROP_FPS)
    # reset frame rate if erroneous value returned
    if frame_rate < 1:
        frame_rate = 15
    print(f"Capturing at {frame_width}x{frame_height} @ {frame_rate}fps")

    detection = MovementDetection(frame_rate=frame_rate)

    while True:
        ret, frame = camera.read()

        if not ret:
            raise RuntimeError("Camera failed")

        if detection.add_frame(frame):
            write_video(detection.get_video(), frame_rate, frame_shape)

def write_video(video, frame_rate, frame_shape):
    # video codec
    fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    # output file
    frame_shape = (video[0].shape[1], video[0].shape[0])
    filename = f"output_{datetime.now().strftime('%Y%m%d%H%M%S')}.mp4"
    out_vid = cv2.VideoWriter(filename, fourcc, frame_rate, frame_shape)
    print(f"Outputting video of {len(video)} frames to {filename}")
    for frame in video:
        out_vid.write(frame)
    out_vid.release()
    print("Video writing complete")


start_camera()