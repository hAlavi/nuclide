/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 */

import * as React from 'react';
import * as Immutable from 'immutable';

export type OnboardingModelState = {
  activeTaskKey: ?string,
  tasks: Immutable.OrderedMap<string, OnboardingTask>,
};

export type OnboardingFragment = {
  description?: string,
  priority: number,
  taskComponent: React.ComponentType<OnboardingTaskComponentProps>,
  taskKey: string,
  title: string,
};

export type OnboardingTask = OnboardingFragment & {
  isCompleted: boolean,
};

export type OnboardingTaskComponentProps = {
  description?: string,
  isCompleted: boolean,
  setTaskCompleted: () => Promise<mixed>,
  taskKey: string,
  title: string,
};
