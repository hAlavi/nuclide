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
 */

import type {Store, ConfirmPhase, RefactorEditResponse} from '../types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import * as React from 'react';

import {getAtomProjectRelativePath} from 'nuclide-commons-atom/projects';
import {pluralize} from 'nuclide-commons/string';
import {Button, ButtonTypes} from 'nuclide-commons-ui/Button';
import {Icon} from 'nuclide-commons-ui/Icon';
import {TreeList, TreeItem} from 'nuclide-commons-ui/Tree';
import PathWithFileIcon from 'nuclide-commons-ui/PathWithFileIcon';

import * as Actions from '../refactorActions';

type Props = {
  phase: ConfirmPhase,
  store: Store,
};

export class ConfirmRefactorComponent extends React.PureComponent<Props> {
  _execute = () => {
    this.props.store.dispatch(Actions.apply(this.props.phase.response));
  };

  _diffPreview = (uri: NuclideUri, response: RefactorEditResponse) => {
    this.props.store.dispatch(
      Actions.loadDiffPreview(this.props.phase, uri, response),
    );
  };

  render(): React.Node {
    const {response} = this.props.phase;
    const editCount = new Map();
    let isLargeRefactoring = false;
    for (const [path, edits] of response.edits) {
      // To avoid crashing the UI with too many edits to render, we place a
      //   threshold at 1000
      if (editCount.size > 1000) {
        isLargeRefactoring = true;
        break;
      }
      editCount.set(path, (editCount.get(path) || 0) + edits.length);
    }
    // TODO: display actual diff output here.
    return (
      <div>
        This refactoring will affect {response.edits.size} files
        {isLargeRefactoring ? ' (showing first 1000)' : ''}. Confirm?
        <div
          // Make the text copyable + selectable.
          className="nuclide-refactorizer-confirm-list native-key-bindings"
          tabIndex={-1}>
          <TreeList>
            {Array.from(editCount).map(([path, count]) => (
              <TreeItem key={path}>
                <PathWithFileIcon
                  className={'nuclide-refactorizer-confirm-list-item'}
                  path={path}>
                  <Icon
                    className="nuclide-refactorizer-diff-preview-icon"
                    onClick={() => {
                      this._diffPreview(path, response);
                    }}
                    icon="diff"
                  />
                  <span className="nuclide-refactorizer-confirm-list-path">
                    {getAtomProjectRelativePath(path)}
                  </span>{' '}
                  ({count} {pluralize('change', count)})
                </PathWithFileIcon>
              </TreeItem>
            ))}
          </TreeList>
        </div>
        <div style={{display: 'flex', justifyContent: 'flex-end'}}>
          <Button
            buttonType={ButtonTypes.PRIMARY}
            onClick={this._execute}
            autoFocus={true}>
            Confirm
          </Button>
        </div>
      </div>
    );
  }
}
