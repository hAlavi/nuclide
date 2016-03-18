'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {AppState} from './types';

import {array} from '../../nuclide-commons';

export default function getCurrentExecutorId(state: AppState): ?string {
  let {currentExecutorId} = state;
  if (currentExecutorId == null) {
    const firstExecutor = array.from(state.executors.values())[0];
    currentExecutorId = firstExecutor && firstExecutor.id;
  }
  return currentExecutorId;
}
