#!/bin/sh
#

set -xe

BIN_PATH=$(cd "$(dirname "$0")"; pwd -P)
WORK_PATH=${BIN_PATH}/../

cd $WORK_PATH

${BIN_PATH}/prisma-migrate.sh

node index.js
