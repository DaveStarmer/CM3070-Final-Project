import logging
from datetime import datetime
import cv2
from movement_detection import MovementDetection

VIDEO_LENGTH = 20
DEFAULT_FRAME_HEIGHT = 480
DEFAULT_FRAME_WIDTH = 640
DEFAULT_FRAME_RATE = 30
BUFFER_TIME = 2

CAMERA_NUMBERS_LIST = [0]


def start_camera():
    """Initialise devices, and loop detection motion

    Raises:
        RuntimeError: Camera failure
    """
    cameras = []
    frame_shapes = []
    frame_rates = []
    detections = []
    for camera_number in CAMERA_NUMBERS_LIST:
        camera, frame_shape, frame_rate = initialise_camera(0)
        print(
            f"Capturing at {frame_shape[camera_number]}x{frame_shape[1]} @ {frame_rate}fps"
        )
        cameras.append(camera)
        frame_shapes.append(frame_shapes)
        frame_rates.append(frame_rate)

        detections.append(MovementDetection(frame_rate=frame_rate))

    while True:
        # iterate through cameras
        for i, detection in enumerate(detections):
            ret, frame = cameras[i].read()

            if not ret:
                # camera is not returning correctly and has failed
                raise RuntimeError("Camera failed")

            # add frame to detector - which will return true if a complete video has been captured
            if detection.add_frame(frame):
                video_file = write_video(
                    detection.get_video(), frame_rates[i], frame_shapes[i]
                )
                upload_video(video_file)
                clean_up_video(video_file)


def initialise_camera(camera_number):
    """Initialise camera from index

    Args:
        camera_number (int): Index of camera to initialise

    Returns:
        cv2.VideoCapture: openCV camera object
        tuple: frame shape (width, height)
        int: frame rate (in fps)
    """
    camera = cv2.VideoCapture(camera_number, cv2.CAP_V4L)

    if camera.isOpened():
        print("Camera started")
    else:
        print("Camera not started")
        quit()

    # set camera up
    camera.set(cv2.CAP_PROP_FRAME_WIDTH, DEFAULT_FRAME_WIDTH)
    camera.set(cv2.CAP_PROP_FRAME_HEIGHT, DEFAULT_FRAME_HEIGHT)
    camera.set(cv2.CAP_PROP_FPS, DEFAULT_FRAME_RATE)

    # get values from camera
    frame_height = int(camera.get(cv2.CAP_PROP_FRAME_HEIGHT))
    frame_width = int(camera.get(cv2.CAP_PROP_FRAME_WIDTH))
    frame_shape = (frame_width, frame_height)
    frame_rate = camera.get(cv2.CAP_PROP_FPS)
    # reset frame rate if erroneous value returned (happens occasionally)
    if frame_rate < 1:
        frame_rate = DEFAULT_FRAME_RATE

    return camera, frame_shape, frame_rate


def write_video(video, frame_rate, frame_shape):
    """Output Video file

    Args:
        video (nparray): Video
        frame_rate (int): frame rate of video
        frame_shape (tuple): shape of frame (width, height)

    Returns:
        str: filename of output file
    """
    # video codec
    # fourcc = cv2.VideoWriter_fourcc(*"mp4v")
    fourcc = cv2.VideoWriter_fourcc(*"avc1")
    # output file
    frame_shape = (video[0].shape[1], video[0].shape[0])
    filename = f"output_{datetime.now().strftime('%Y%m%d%H%M%S')}.mp4"
    out_vid = cv2.VideoWriter(filename, fourcc, frame_rate, frame_shape)
    print(f"Outputting video of {len(video)} frames to {filename}")
    for frame in video:
        out_vid.write(frame)
    out_vid.release()
    print("Video writing complete")

    return filename


def upload_video(filename):
    pass


def clean_up_video(filename):
    pass


start_camera()
