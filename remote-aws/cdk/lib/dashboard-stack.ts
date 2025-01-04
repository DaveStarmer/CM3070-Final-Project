import { CfnParameter, Fn, Stack, StackProps } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export class DashboardStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    const uniqueId = new CfnParameter(this, "uniqueId", {
      type: "String",
      description: "Unique element for bucket naming",
      allowedPattern: "^[a-z0-9-]{1,32}$"
    });

    /** name of private code bucket */
    const codeBucketName = new CfnParameter(this, "codeBucketName", {
      type: "String",
      description: "Private Code Bucket Name",
      allowedPattern: "^[a-z0-9\.-]{1,63}$"
    })

    /** private code bucket construct */
    const codeBucket = Bucket.fromBucketName(this, "codeBucket", Fn.ref(codeBucketName.toString()))

    /** video clip storage bucket */
    new Bucket(this, "videoBucket", {
      bucketName: Fn.sub("vid-dash-video-${uniqueId}")
    })
  }
}
