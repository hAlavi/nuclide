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

import nuclideUri from 'nuclide-commons/nuclideUri';

import {runCommand} from 'nuclide-commons/process';

export const VENDOR_PYTHONPATH = nuclideUri.join(__dirname, '../VendorLib');

let fbFindClangServerArgs: ?(src: ?string) => {[string]: ?string};

export type PartialClangServerArgs = {
  libClangLibraryFile?: string,
  pythonExecutable?: string,
  pythonPathEnv?: string,
};

export type ClangServerArgs = {
  libClangLibraryFile: ?string,
  pythonExecutable: string,
  pythonPathEnv: ?string,
};

export default (async function findClangServerArgs(
  src: ?string,
  libclangPath: ?string = null,
  configLibclangPath: ?string,
): Promise<ClangServerArgs> {
  if (fbFindClangServerArgs === undefined) {
    fbFindClangServerArgs = null;
    try {
      // $FlowFB
      fbFindClangServerArgs = require('./fb/find-clang-server-args').default;
    } catch (e) {
      // Ignore.
    }
  }

  let libClangLibraryFile;
  if (process.platform === 'darwin') {
    try {
      const stdout = await runCommand('xcode-select', [
        '--print-path',
      ]).toPromise();
      libClangLibraryFile = stdout.trim();
      // If the user only has Xcode Command Line Tools installed, the path is different.
      if (nuclideUri.basename(libClangLibraryFile) !== 'CommandLineTools') {
        libClangLibraryFile += '/Toolchains/XcodeDefault.xctoolchain';
      }
      libClangLibraryFile += '/usr/lib/libclang.dylib';
    } catch (err) {}
  }

  if (configLibclangPath != null) {
    libClangLibraryFile = configLibclangPath.trim();
  }

  let clangServerArgs = {
    libClangLibraryFile,
    pythonExecutable: 'python2.7',
    pythonPathEnv: VENDOR_PYTHONPATH,
  };

  if (typeof fbFindClangServerArgs === 'function') {
    const clangServerArgsOverrides = await fbFindClangServerArgs(src);
    clangServerArgs = {
      ...clangServerArgs,
      ...clangServerArgsOverrides,
    };
  }

  if (libclangPath != null) {
    clangServerArgs.libClangLibraryFile = libclangPath;
  }
  return clangServerArgs;
});
