import { CfnParameter, Fn, Stack, StackProps } from "aws-cdk-lib";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";

export class DeploymentStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props)

    const uniqueId = new CfnParameter(this, "uniqueId", {
          type: "String",
          description: "Unique element for bucket naming",
          allowedPattern: "^[a-z0-9-]{1,32}$"
        })

    const codeBucket = new Bucket(this, "codeBucket", {
      bucketName: Fn.sub("deployment-code-${uniqueId}")
    })
  }
}
