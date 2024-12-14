import time
from datetime import datetime
import cv2

VIDEO_LENGTH = 20
FRAME_HEIGHT = 480
FRAME_WIDTH = 640
FRAME_RATE = 15
BUFFER_TIME = 2

camera = cv2.VideoCapture(0, cv2.CAP_V4L)

if camera.isOpened():
    print("Camera started")
else:
    print("Camera not started")
    quit()

# set camera to chosen values
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

# video codec
fourcc = cv2.VideoWriter_fourcc(*"mp4v")
# output file
filename = f"output_{datetime.now().strftime('%Y%m%d%H%M%S')}.mp4"
out_vid = cv2.VideoWriter(filename, fourcc, frame_rate, frame_shape)

# work out time limits for recording video
start_time = time.time() + BUFFER_TIME
finish_time = start_time + VIDEO_LENGTH

# record video
while time.time() < finish_time:
    ret, frame = camera.read()
    out_vid.write(frame)

# release video resources
camera.release()
out_vid.release()

print(f"output file: {filename}")