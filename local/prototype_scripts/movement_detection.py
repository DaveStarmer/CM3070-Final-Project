from pathlib import Path
import cv2

filename = 'non_vcs_video/output_20241209231543.mp4'
filename_path = Path(filename)
out_filename = filename_path.with_stem(filename_path.stem + "_processed")
det_filename = filename_path.with_stem(filename_path.stem + "_detected")

video = cv2.VideoCapture(filename)
DIFF_FRAMES = [0, 1, 2]
alert_contour_area = 10000
detection_threshold = 50

# check video file has opened
if not video.isOpened():
    print(f"File not opened successfully: {filename}")
    quit()

# video sizes
frame_width = int(video.get(cv2.CAP_PROP_FRAME_WIDTH))
frame_height = int(video.get(cv2.CAP_PROP_FRAME_HEIGHT))
frame_rate = video.get(cv2.CAP_PROP_FPS)
frame_shape = (frame_width, frame_height)


fdiff_frames = []
bg_sub_frames = []
colour_frames = []

# blur ksize
blur_ksize = (15, 15)

# background subtractor
bg_sub = cv2.createBackgroundSubtractorMOG2(history=20,varThreshold=25)

# video codec
# fourcc = cv2.VideoWriter_fourcc(*"mp4v")
fourcc = cv2.VideoWriter_fourcc(*"divx")

# output file
print(out_filename, fourcc, frame_rate, frame_shape)
out_vid = cv2.VideoWriter(out_filename, fourcc, frame_rate, frame_shape)
det_vid = cv2.VideoWriter(det_filename, fourcc, frame_rate, frame_shape)


while True:
    ret, frame = video.read()

    if not ret:
        # EOF
        break

    # frame detection frame
    fdiff_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    fdiff_frame = cv2.GaussianBlur(fdiff_frame, blur_ksize, 0)

    fdiff_frames.append(fdiff_frame)
    colour_frames.append(frame)

    # do background subtraction for frame
    bg_sub_frames.append(bg_sub.apply(frame))

    if video.get(cv2.CAP_PROP_POS_FRAMES) > max(DIFF_FRAMES):
        # 3 frame differencing, whether standard or modified uses the 'current' frame, an earlier
        # and a later one (how much earlier/later depends on the algorithm)
        earlier_frame = DIFF_FRAMES[0]
        current_frame = DIFF_FRAMES[1]
        later_frame = DIFF_FRAMES[2]

        # deltas between successive frames being considered
        delta1 = cv2.absdiff(fdiff_frames[earlier_frame], fdiff_frames[current_frame])
        delta2 = cv2.absdiff(fdiff_frames[current_frame], fdiff_frames[later_frame])

        # compare deltas
        overall_delta = cv2.absdiff(delta1, delta2)
        threshold_frame = cv2.threshold(overall_delta, detection_threshold, 255, cv2.THRESH_BINARY)[1]

        # fdiff_frame = bg_sub_frames[current_frame]
        # fdiff_frame = threshold_frame
        # f_diff_frame = cv2.add(bg_sub_frames[current_frame],threshold_frame)

        out_frame = colour_frames[current_frame].copy()

        # sort contours
        if video.get(cv2.CAP_PROP_POS_FRAMES) > 2:
            contours, _ = cv2.findContours(fdiff_frame, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

            for contour in contours:
                x, y, w, h = cv2.boundingRect(contour)
                if w * h > alert_contour_area:
                    cv2.rectangle(out_frame, (x,y), (x+w, y+h), (0,255,0), 2)

        # output frame to file
        out_vid.write(out_frame)
        cv2.imshow("Test", out_frame)

        out_det_frame = cv2.cvtColor(bg_sub_frames[DIFF_FRAMES[1]],cv2.COLOR_GRAY2BGR)
        det_vid.write(out_det_frame)
        cv2.imshow("Detection", out_det_frame)

        # remove first frame from lists
        fdiff_frames = fdiff_frames[1:]
        colour_frames = colour_frames[1:]
        bg_sub_frames = bg_sub_frames[1:]

    if cv2.waitKey(1) == ord('q'):
        break

video.release()
