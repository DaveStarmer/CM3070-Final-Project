#!/bin/bash

# lambda name taken from folder name (using standard handler.py for module within lambda)
lambda_name=$(basename "$1")
# directory=$(dirname "$1")

# output information for debug
echo =====
echo $lambda_name
echo $1

# move into lambda folder
cd $1

# if requirements.txt is present, do a pip install to the folder
if [ -e requirements.txt ]
then
    pip install --target . -r requirements.txt
fi

# zip the folder up complete with dependencies
zip -r ../${lambda_name}.zip * -x tests/*

# create hash of file
folder_hash=$(grep -ar -e . . | md5sum | cut -d " " -f 1)

# rename zip file with hash suffixed to file name
hash_zip_filename=${lambda_name}-${folder_hash}.zip
mv ../${lambda_name}.zip ../${hash_zip_filename}

# upload to appropriate s3 bucket
# aws s3 cp ../${hash_zip_filename} s3://$2/lambdas/

# return to original folder
cd -
pwd
# write new zip file name into cdk.json
jq -c '.context.lambdas."'"$lambda_name"'" = "'"$hash_zip_filename"'"' remote-aws/cdk/cdk.json > tempcdk.json
jq '.context.lambdas' tempcdk.json
mv tempcdk.json remote-aws/cdk/cdk.json
echo cdk.json updated

echo $hash_zip_filename
