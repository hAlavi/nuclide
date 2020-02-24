/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 * @emails oncall+nuclide
 */
import type {PtyClient} from '../lib/pty-service/rpc-types';
import invariant from 'assert';

import {spawn} from '../lib/pty-service/PtyService';

describe('PtyService', () => {
  describe('spawn', () => {
    let ptyInfo;
    let runner;

    beforeEach(() => {
      ptyInfo = {
        terminalType: 'xterm',
        command: {
          file: '',
          args: [],
        },
      };
      runner = new LocalRunner();
    });

    it('adds numbers in bash', async () => {
      invariant(ptyInfo.command != null);
      ptyInfo.command.file = '/bin/bash';
      ptyInfo.command.args = ['--norc', '-c', 'echo $((1 + 1))'];
      await spawn(ptyInfo, runner);
      const result = await runner.promise;
      expect(result.output.trim()).toBe('2');
      expect(result.code).toBe(0);
    });
  });
});

type PtyResult = {
  output: string,
  code: number,
  signal: number,
};

class LocalRunner implements PtyClient {
  promise: Promise<PtyResult>;
  _output: string;
  _resolve: (result: PtyResult) => void;

  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this._resolve = resolve;
    });
    this._output = '';
  }

  onOutput(data: string): void {
    this._output += data;
  }

  onExit(code: number, signal: number): void {
    this._resolve({output: this._output, code, signal});
  }

  dispose() {}
}
