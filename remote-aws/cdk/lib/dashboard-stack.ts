import { CfnParameter, Fn, Stack, StackProps } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export class DashboardStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    const uniqueId = new CfnParameter(this, "uniqueId", {
      type: "String",
      description: "Unique element for buckets",
      default: Fn.ref("AWS::AccountId")
    });

    new Bucket(this, "videoBucket", {
      bucketName: Fn.sub("vid-dash-${uniqueId}-video")
    })
  }
}
