/**
 * Face detection in the browser with MediaPipe Face Detector (BlazeFace short-range).
 *
 * All files are bundled by Vite: `?url` imports give each file's served URL and copy it into the build.
 * The WASM comes from the npm package, the model is committed next to this file. No CDN, no setup step.
 */
import { FaceDetector, type BoundingBox, type Detection } from '@mediapipe/tasks-vision'
import wasmLoaderPath from '@mediapipe/tasks-vision/vision_wasm_internal.js?url'
import wasmBinaryPath from '@mediapipe/tasks-vision/vision_wasm_internal.wasm?url'
import modelPath from './blaze_face_short_range.tflite?url'

export type { BoundingBox, Detection, FaceDetector }
export type Delegate = 'GPU' | 'CPU'

/** BlazeFace returns its 6 keypoints in this order. "Right" and "left" are the person's own, not the screen's. */
export const KEYPOINT_NAMES = ['right eye', 'left eye', 'nose tip', 'mouth', 'right ear', 'left ear']

/**
 * Loads the WASM runtime and the model. Call `.close()` when done.
 * VIDEO mode is for the door's camera loop (`detectForVideo`). IMAGE mode is for one still image (`detect`), for enrollment.
 */
export function createFaceDetector(
  delegate: Delegate = DEFAULT_SETTINGS.delegate,
  minDetectionConfidence = DEFAULT_SETTINGS.minConfidence,
  runningMode: 'VIDEO' | 'IMAGE' = 'VIDEO',
) {
  // FilesetResolver.forVisionTasks(folder) would guess file names in a folder; we pass the exact URLs instead.
  return FaceDetector.createFromOptions(
    { wasmLoaderPath, wasmBinaryPath },
    { baseOptions: { modelAssetPath: modelPath, delegate }, runningMode, minDetectionConfidence },
  )
}

/**
 * Every knob of the browser side of face detection. The terminal uses DEFAULT_SETTINGS;
 * /prototype/face-detect lets you change them live.
 */
export interface DetectionSettings {
  /** Where the model runs: GPU (WebGL) or CPU (WASM). */
  delegate: Delegate
  /** The detector drops faces below this score (0–1). */
  minConfidence: number
  /** How often the model runs. */
  detectEveryMs: number
  /** How often the best face is sent. */
  windowMs: number
  /**
   * Faces narrower than this, in camera pixels, are ignored: people far away or walking past.
   * In pixels, not a share of the frame, because what matters is detail: the server's model looks
   * at the face at about 112 px, so a smaller face would be upscaled and recognized badly.
   */
  minFacePx: number
  /** Share of the window's frames that must have a usable face before anything is sent. */
  minSteady: number
  /** Side of the square JPEG sent to the server, in pixels. */
  cropSize: number
  /** The crop is the face box's longer side times this. BlazeFace's box is tight (brows to chin). */
  cropMargin: number
  /** JPEG quality, 0–1. */
  jpegQuality: number
}

export const DEFAULT_SETTINGS: DetectionSettings = {
  delegate: 'GPU',
  minConfidence: 0.85,
  detectEveryMs: 100,
  windowMs: 1000,
  minFacePx: 128, // 112 px model input plus some headroom
  minSteady: 0.3, // 3 of 10 frames
  cropSize: 320, // the face fills about 160 px of it
  cropMargin: 2.0,
  jpegQuality: 0.85,
}

export const scoreOf = (d: Detection) => d.categories[0]?.score ?? 0

const area = (d: Detection) => (d.boundingBox ? d.boundingBox.width * d.boundingBox.height : 0)

/** True if the face is big enough (close enough) to act on. */
export const isCloseEnough = (d: Detection, minFacePx: number) => !!d.boundingBox && d.boundingBox.width >= minFacePx

/**
 * The face to act on: highest score, then the biggest (closest to the door).
 * TODO: check every face at the door (GIL-68).
 */
export function bestDetection(detections: Detection[]): Detection | null {
  let best: Detection | null = null
  for (const d of detections) {
    if (!d.boundingBox) continue
    if (!best || scoreOf(d) > scoreOf(best) || (scoreOf(d) === scoreOf(best) && area(d) > area(best))) best = d
  }
  return best
}

/**
 * ORIENTATION RULE: every face image the server sees is mirrored (selfie view): terminal crops,
 * webcam enrollment and uploaded photos. All of them go through cropFace, which mirrors. Only
 * consistency matters for matching; mirrored was picked because it looks natural. Live <video>
 * previews are flipped with CSS; crops are already mirrored, so never CSS-flip them again.
 */
export function mirror(ctx: CanvasRenderingContext2D, width: number) {
  ctx.translate(width, 0)
  ctx.scale(-1, 1)
}

/** Anything a face can be found in and cropped from: the door's camera, a captured frame, an uploaded photo. */
export type FaceSource = HTMLVideoElement | HTMLCanvasElement | HTMLImageElement | ImageBitmap

/** The source's own size in pixels, the space BlazeFace's boxes are in. */
function sourceSize(source: FaceSource) {
  if (source instanceof HTMLVideoElement) return { width: source.videoWidth, height: source.videoHeight }
  if (source instanceof HTMLImageElement) return { width: source.naturalWidth, height: source.naturalHeight }
  return { width: source.width, height: source.height }
}

/** The video's current frame on a canvas, not mirrored. Detect and crop on it, so both see the same frame. */
export function grabFrame(video: HTMLVideoElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  canvas.getContext('2d')?.drawImage(video, 0, 0)
  return canvas
}

/** Draws a loose square around the face onto a `size` canvas, mirrored (see the orientation rule). */
export function cropFace(
  source: FaceSource,
  box: BoundingBox,
  size = DEFAULT_SETTINGS.cropSize,
  margin = DEFAULT_SETTINGS.cropMargin,
): HTMLCanvasElement {
  const { width: vw, height: vh } = sourceSize(source)
  const side = Math.min(Math.max(box.width, box.height) * margin, vw, vh)
  const cx = box.originX + box.width / 2
  const cy = box.originY + box.height / 2
  const sx = Math.min(Math.max(cx - side / 2, 0), vw - side)
  const sy = Math.min(Math.max(cy - side / 2, 0), vh - side)

  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    // Flip the destination, so the source rectangle above stays in camera coordinates.
    mirror(ctx, size)
    ctx.drawImage(source, sx, sy, side, side, 0, 0, size, size)
  }
  return canvas
}

export const toJpeg = (canvas: HTMLCanvasElement, quality = DEFAULT_SETTINGS.jpegQuality) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))

/**
 * Enrollment: the one face in a still image, cropped and encoded exactly like the door's crops.
 * `detector` must be in IMAGE mode. Throws an Error whose message is shown to the admin.
 */
export async function enrollmentCrop(
  detector: FaceDetector,
  image: Exclude<FaceSource, HTMLVideoElement>,
  settings = DEFAULT_SETTINGS,
): Promise<Blob> {
  // The detector already drops faces under its minimum confidence.
  const faces = detector.detect(image).detections.filter((d) => d.boundingBox)
  if (faces.length === 0) throw new Error('No face found. Use a clear, front-facing photo.')
  if (faces.length > 1) throw new Error('More than one face. Use a photo of one person.')
  const face = faces[0]!
  if (!isCloseEnough(face, settings.minFacePx)) throw new Error('The face is too small. Move closer, or use a bigger photo.')
  const jpeg = await toJpeg(cropFace(image, face.boundingBox!, settings.cropSize, settings.cropMargin), settings.jpegQuality)
  if (!jpeg) throw new Error("Couldn't prepare the photo. Try again.")
  return jpeg
}

export interface ScreenBox {
  left: number
  top: number
  width: number
  height: number
}

/**
 * Maps a box from video pixels to the on-screen element, for a <video> shown with
 * `object-fit: cover` (scaled to fill, edges cut off) and optionally flipped with `scaleX(-1)`.
 */
export function toScreenBox(
  box: BoundingBox,
  video: { width: number; height: number },
  element: { width: number; height: number },
  mirror: boolean,
): ScreenBox {
  const scale = Math.max(element.width / video.width, element.height / video.height)
  const offsetX = (element.width - video.width * scale) / 2
  const offsetY = (element.height - video.height * scale) / 2
  const width = box.width * scale
  const left = offsetX + box.originX * scale
  return {
    left: mirror ? element.width - left - width : left,
    top: offsetY + box.originY * scale,
    width,
    height: box.height * scale,
  }
}
