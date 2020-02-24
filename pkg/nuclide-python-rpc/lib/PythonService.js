/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {
  LanguageService,
  Completion,
} from '../../nuclide-language-service/lib/LanguageService';
import type {FileNotifier} from '../../nuclide-open-files-rpc/lib/rpc-types';
import type {TextEdit} from 'nuclide-commons-atom/text-edit';
import type {TypeHint} from '../../nuclide-type-hint/lib/rpc-types';
import type {CoverageResult} from '../../nuclide-type-coverage/lib/rpc-types';
import type {
  DefinitionQueryResult,
  DiagnosticMessageType,
  FindReferencesReturn,
  RenameReturn,
  Outline,
  CodeAction,
  SignatureHelp,
} from 'atom-ide-ui';
import type {
  AutocompleteResult,
  FileDiagnosticMap,
  FileDiagnosticMessage,
} from '../../nuclide-language-service/lib/LanguageService';
import type {ConnectableObservable} from 'rxjs';

import invariant from 'assert';
import {Observable} from 'rxjs';
import {
  runCommand,
  ProcessExitError,
  getOriginalEnvironment,
} from 'nuclide-commons/process';
import {asyncSome} from 'nuclide-commons/promise';
import {wordAtPositionFromBuffer} from 'nuclide-commons/range';
import {maybeToString} from 'nuclide-commons/string';
import fsPromise from 'nuclide-commons/fsPromise';
import nuclideUri from 'nuclide-commons/nuclideUri';
import once from 'nuclide-commons/once';
import {IDENTIFIER_REGEXP} from './constants';
import JediServerManager from './JediServerManager';
import {parseFlake8Output} from './flake8';
import {ServerLanguageService} from '../../nuclide-language-service-rpc';
import {itemsToOutline} from './outline';
import {Point, Range} from 'simple-text-buffer';
import {FileCache} from '../../nuclide-open-files-rpc';
import {getAutocompleteSuggestions} from './AutocompleteHelpers';
import {getDefinition} from './DefinitionHelpers';

export type PythonCompletion = {
  type: string,
  text: string,
  description?: string,
  params: ?Array<string>,
};

export type PythonDefinition = {
  type: string,
  text: string,
  file: NuclideUri,
  line: number,
  column: number,
};

export type PythonReference = {
  type: string,
  text: string,
  file: NuclideUri,
  line: number,
  column: number,
  parentName?: string,
};

export type Position = {
  line: number,
  column: number,
};

export type PythonFunctionItem = {
  kind: 'function',
  name: string,
  start: Position,
  end: Position,
  children?: Array<PythonOutlineItem>,
  docblock?: string,
  params?: Array<string>,
};

export type PythonClassItem = {
  kind: 'class',
  name: string,
  start: Position,
  end: Position,
  children?: Array<PythonOutlineItem>,
  docblock?: string,
  // Class params, i.e. superclasses.
  params?: Array<string>,
};

export type PythonStatementItem = {
  kind: 'statement',
  name: string,
  start: Position,
  end: Position,
  docblock?: string,
};

export type PythonOutlineItem =
  | PythonFunctionItem
  | PythonClassItem
  | PythonStatementItem;

export type PythonDiagnostic = {
  file: NuclideUri,
  code: string,
  message: string,
  type: DiagnosticMessageType,
  line: number,
  column: number,
};

export type PythonServiceConfig = {
  showGlobalVariables: boolean,
  autocompleteArguments: boolean,
  includeOptionalArguments: boolean,
};

const serverManager = new JediServerManager();

export async function initialize(
  fileNotifier: FileNotifier,
  config: PythonServiceConfig,
): Promise<LanguageService> {
  return new ServerLanguageService(
    fileNotifier,
    new PythonSingleFileLanguageService(fileNotifier, config),
  );
}

class PythonSingleFileLanguageService {
  _fileCache: FileCache;
  _showGlobalVariables: boolean;
  _autocompleteArguments: boolean;
  _includeOptionalArguments: boolean;

  constructor(fileNotifier: FileNotifier, config: PythonServiceConfig) {
    invariant(fileNotifier instanceof FileCache);
    this._fileCache = fileNotifier;
    this._showGlobalVariables = config.showGlobalVariables;
    this._autocompleteArguments = config.autocompleteArguments;
    this._includeOptionalArguments = config.includeOptionalArguments;
  }

  async getCodeActions(
    filePath: NuclideUri,
    range: atom$Range,
    diagnostics: Array<FileDiagnosticMessage>,
  ): Promise<Array<CodeAction>> {
    throw new Error('Not implemented');
  }

  getDiagnostics(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
  ): Promise<?FileDiagnosticMap> {
    throw new Error('Not Yet Implemented');
  }

  observeDiagnostics(): ConnectableObservable<FileDiagnosticMap> {
    throw new Error('Not Yet Implemented');
  }

  getAutocompleteSuggestions(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    position: atom$Point,
    activatedManually: boolean,
  ): Promise<AutocompleteResult> {
    return getAutocompleteSuggestions(
      serverManager,
      filePath,
      buffer,
      position,
      activatedManually,
      this._autocompleteArguments,
      this._includeOptionalArguments,
    );
  }

  resolveAutocompleteSuggestion(suggestion: Completion): Promise<?Completion> {
    return Promise.resolve(null);
  }

  getDefinition(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    position: atom$Point,
  ): Promise<?DefinitionQueryResult> {
    return getDefinition(serverManager, filePath, buffer, position);
  }

  findReferences(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    position: atom$Point,
  ): Observable<?FindReferencesReturn> {
    return Observable.fromPromise(
      this._findReferences(filePath, buffer, position),
    );
  }

  async _findReferences(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    position: atom$Point,
  ): Promise<?FindReferencesReturn> {
    const result = await _getReferences(
      serverManager,
      filePath,
      buffer.getText(),
      position.row,
      position.column,
    );

    if (!result || result.length === 0) {
      return {type: 'error', message: 'No usages were found.'};
    }

    const symbolName = result[0].text;

    // Process this into the format nuclide-find-references expects.
    const references = result.map(ref => {
      return {
        uri: ref.file,
        name: ref.parentName,
        range: new Range(
          new Point(ref.line, ref.column),
          new Point(ref.line, ref.column + ref.text.length),
        ),
      };
    });

    // Choose the project root as baseUri, or if no project exists,
    // use the dirname of the src file.
    const baseUri =
      this._fileCache.getContainingDirectory(filePath) ||
      nuclideUri.dirname(filePath);

    return {
      type: 'data',
      baseUri,
      referencedSymbolName: symbolName,
      references,
    };
  }

  rename(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    position: atom$Point,
    newName: string,
  ): Observable<?RenameReturn> {
    throw new Error('Not Yet Implemented');
  }

  getCoverage(filePath: NuclideUri): Promise<?CoverageResult> {
    throw new Error('Not Yet Implemented');
  }

  async getOutline(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
  ): Promise<?Outline> {
    const service = await serverManager.getJediService();
    const items = await service.get_outline(filePath, buffer.getText());

    if (items == null) {
      return null;
    }

    const mode = this._showGlobalVariables ? 'all' : 'constants';
    return {
      outlineTrees: itemsToOutline(mode, items),
    };
  }

  async typeHint(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    position: atom$Point,
  ): Promise<?TypeHint> {
    const word = wordAtPositionFromBuffer(buffer, position, IDENTIFIER_REGEXP);
    if (word == null) {
      return null;
    }
    const service = await serverManager.getJediService();
    const result = await service.get_hover(
      filePath,
      buffer.getText(),
      serverManager.getSysPath(filePath),
      word.wordMatch[0],
      position.row,
      position.column,
    );
    if (result == null) {
      return null;
    }
    return {
      hint: [
        {
          type: 'markdown',
          value: result,
        },
      ],
      range: word.range,
    };
  }

  async onToggleCoverage(set: boolean): Promise<void> {
    return;
  }

  highlight(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    position: atom$Point,
  ): Promise<?Array<atom$Range>> {
    throw new Error('Not Yet Implemented');
  }

  formatSource(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    range: atom$Range,
  ): Promise<?Array<TextEdit>> {
    throw new Error('Not Yet Implemented');
  }

  async formatEntireFile(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    range: atom$Range,
  ): Promise<?{
    newCursor?: number,
    formatted: string,
  }> {
    const contents = buffer.getText();
    const {command, args} = await getFormatterCommandImpl()(filePath, range);
    const dirName = nuclideUri.dirname(nuclideUri.getPath(filePath));

    let stdout;
    try {
      stdout = await runCommand(command, args, {
        cwd: dirName,
        input: contents,
        env: await getOriginalEnvironment(),
        // At the moment, yapf outputs 3 possible exit codes:
        // 0 - success, no content change.
        // 2 - success, contents changed.
        // 1 - internal failure, most likely due to syntax errors.
        //
        // See: https://github.com/google/yapf/issues/228#issuecomment-198682079
        isExitError: exit => exit.exitCode === 1,
      }).toPromise();
    } catch (err) {
      throw new Error(`"${command}" failed, likely due to syntax errors.`);
    }

    if (contents !== '' && stdout === '') {
      // Throw error if the yapf output is empty, which is almost never desirable.
      throw new Error('Empty output received from yapf.');
    }

    return {formatted: stdout};
  }

  formatAtPosition(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    position: atom$Point,
    triggerCharacter: string,
  ): Promise<?Array<TextEdit>> {
    throw new Error('Not Yet Implemented');
  }

  async signatureHelp(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    position: atom$Point,
  ): Promise<?SignatureHelp> {
    const service = await serverManager.getJediService();
    return service.get_signature_help(
      filePath,
      buffer.getText(),
      serverManager.getSysPath(filePath),
      position.row,
      position.column,
    );
  }

  getProjectRoot(fileUri: NuclideUri): Promise<?NuclideUri> {
    throw new Error('Not Yet Implemented');
  }

  isFileInProject(fileUri: NuclideUri): Promise<boolean> {
    throw new Error('Not Yet Implemented');
  }

  getExpandedSelectionRange(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    currentSelection: atom$Range,
  ): Promise<?atom$Range> {
    throw new Error('Not Yet Implemented');
  }

  getCollapsedSelectionRange(
    filePath: NuclideUri,
    buffer: simpleTextBuffer$TextBuffer,
    currentSelection: atom$Range,
    originalCursorPosition: atom$Point,
  ): Promise<?atom$Range> {
    throw new Error('Not Yet Implemented');
  }

  dispose(): void {}
}

const getFormatterCommandImpl = once(() => {
  try {
    // $FlowFB
    return require('./fb/get-formatter-command').default;
  } catch (e) {
    return (filePath, range) => ({
      command: 'yapf',
      args: ['--lines', `${range.start.row + 1}-${range.end.row + 1}`],
    });
  }
});

// Exported for testing.
export async function _getReferences(
  manager: JediServerManager,
  src: NuclideUri,
  contents: string,
  line: number,
  column: number,
): Promise<?Array<PythonReference>> {
  const service = await manager.getJediService();
  return service.get_references(
    src,
    contents,
    manager.getSysPath(src),
    line,
    column,
  );
}

// Set to false if flake8 isn't found, so we don't repeatedly fail.
let shouldRunFlake8 = true;

export async function getDiagnostics(
  src: NuclideUri,
): Promise<Array<PythonDiagnostic>> {
  if (!shouldRunFlake8) {
    return [];
  }

  let result;
  try {
    result = await runLinterCommand(src);
  } catch (err) {
    // A non-successful exit code can result in some cases that we want to ignore,
    // for example when an incorrect python version is specified for a source file.
    if (err instanceof ProcessExitError) {
      return [];
    } else if (err.errorCode === 'ENOENT') {
      // Don't throw if flake8 is not found on the user's system.
      // Don't retry again.
      shouldRunFlake8 = false;
      return [];
    }
    throw new Error(`flake8 failed with error: ${maybeToString(err.message)}`);
  }

  return parseFlake8Output(src, result);
}

async function runLinterCommand(src: NuclideUri): Promise<string> {
  const dirName = nuclideUri.dirname(src);

  let result;
  let runFlake8;
  try {
    // $FlowFB
    runFlake8 = require('./fb/run-flake8').default;
  } catch (e) {
    // Ignore.
  }

  if (runFlake8 != null) {
    result = await runFlake8(src);
    if (result != null) {
      return result;
    }
  }

  const command =
    (global.atom && atom.config.get('nuclide.nuclide-python.pathToFlake8')) ||
    'flake8';

  invariant(typeof command === 'string');
  return runCommand(command, [src], {
    cwd: dirName,
    env: await getOriginalEnvironment(),
    // 1 indicates unclean lint result (i.e. has errors/warnings).
    isExitError: exit => exit.exitCode == null || exit.exitCode > 1,
  }).toPromise();
}

/**
 * Retrieves a list of buildable targets to obtain link trees for a given file.
 * (This won't return anything if a link tree is already available.)
 */
export async function getBuildableTargets(
  src: NuclideUri,
): Promise<Array<string>> {
  const linkTreeManager = serverManager._linkTreeManager;
  const linkTrees = await linkTreeManager.getLinkTreePaths(src);
  if (linkTrees.length === 0) {
    return [];
  }
  if (await asyncSome(linkTrees, fsPromise.exists)) {
    return [];
  }
  const buckRoot = await linkTreeManager.getBuckRoot(src);
  const owner = await linkTreeManager.getOwner(src);
  if (buckRoot == null || owner == null) {
    return [];
  }
  const dependents = await linkTreeManager.getDependents(buckRoot, owner);
  return Array.from(dependents.keys());
}

export function reset(): void {
  serverManager.reset();
}
