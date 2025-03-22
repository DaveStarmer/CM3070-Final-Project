#!/bin/bash

# catch non-zero (error) exit codes
set +e

# git diff on files (create exit code, supress output)
git diff --exit-code HEAD HEAD~1 $1 > /dev/null

# output exit code
echo $?

# stop catching non-zero (error) exit codes
set -e