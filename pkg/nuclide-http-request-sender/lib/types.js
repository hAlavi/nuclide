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

type Verb = 'GET' | 'POST';

export type AppState = {
  uri: string,
  method: Verb,
  headers: {[key: string]: string},
  body: ?string,
  parameters: Array<Parameter>,
};

export type PartialAppState = {
  uri?: string,
  method?: Verb,
  headers?: {[key: string]: string},
  body?: ?string,
  parameters?: Array<Parameter>,
};

export type Store = {
  subscribe(() => mixed): () => void,
  getState(): AppState,
  dispatch(action: Action): void,
};

export type BoundActionCreators = {
  updateState(state: PartialAppState): void,
  sendHttpRequest(): void,
};

export type UpdateStateAction = {
  type: 'UPDATE_STATE',
  payload: {
    state: Object,
  },
};

export type SendRequestAction = {
  type: 'SEND_REQUEST',
};

export type Parameter = ?{
  key: string,
  value: string,
};

export type Action = UpdateStateAction | SendRequestAction;
