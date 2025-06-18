#!/bin/sh
#

set -xe

BIN_PATH=$(cd "$(dirname "$0")"; pwd -P)
WORK_PATH=${BIN_PATH}/../


${BIN_PATH}/prisma-migrate.sh

cd $WORK_PATH

node index.js
