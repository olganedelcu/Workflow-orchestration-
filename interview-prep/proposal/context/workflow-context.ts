// The shared data bag that flows between steps
// resolveInputMapping: reads "stepOutputs.ocr.face_crop_uri" from context
// writeStepOutput: stores a step's result in context.stepOutputs[stepId]
// Data rule: large files (images) go to S3, only URIs stored here
