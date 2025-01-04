import { CfnParameter, Fn, Stack, StackProps } from "aws-cdk-lib";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export class DeploymentStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    const codeBucketName = new CfnParameter(this, "codeBucketName", {
      type: "String",
      description: "Private Code Bucket Name",
      allowedPattern: "^[a-z0-9\.-]{1,63}$"
    })

    /** Private Code Bucket */
    new Bucket(this, "codeBucket", {
      bucketName: Fn.ref("codeBucketName")
    })
  }
}
