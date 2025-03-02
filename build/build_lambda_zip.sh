#!/bin/bash

lambda_name=$(basename "$1")
dir_name=$(dirname "$1")
echo $lambda_name
echo $1
cd $1
echo $(pwd)
ls -lash
ls -lash ..
if [ -e requirements.txt ]
then
    pip install --target . -r requirements.txt
fi
zip -r ../${lambda_name}.zip * -x tests/*
aws s3 cp ../${lambda_name}.zip s3://$2/lambdas/
cd -
