import { CfnParameter, Fn, Stack, StackProps } from 'aws-cdk-lib';
import { Bucket } from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';
import { createHash } from 'node:crypto'

export class InstructionsStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    const uniqueId = new CfnParameter(this, "uniqueId", {
      type: "String",
      description: "Unique element for bucket naming",
      allowedPattern: "^[a-z0-9-]{1,32}$"
    })
      
    /** Unique ID for public-facing resources */
    const publicUniqueId = createHash('md5').update(uniqueId.toString()).digest('hex')
      
    /** Bucket for code upload for sharing and  */
    const codeBucket = new Bucket(this, "codeBucket", {
      bucketName: Fn.sub("instruct-code-${publicUniqueId}")
    })
  }
}
