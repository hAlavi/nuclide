/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 * @emails oncall+nuclide
 */
import nuclideUri from 'nuclide-commons/nuclideUri';
import fs from 'fs';
import {itemsToOutline} from '../lib/outline';

describe('Python outline', () => {
  it('converts from JSON to outline', () => {
    // Test using a fixture file containing the json representation of
    // the PythonService.getOutline result. We're only testing the conversion
    // of the raw outline to an OutlineTree, without calling the service.
    const outlinePath = nuclideUri.join(
      __dirname,
      '../__mocks__/fixtures/t.json',
    );
    const resultPath = nuclideUri.join(
      __dirname,
      '../__mocks__/fixtures/t_expected_result.json',
    );

    const outlineItems = JSON.parse(fs.readFileSync(outlinePath, 'utf8'));
    const expectedResult = JSON.parse(fs.readFileSync(resultPath, 'utf8'));

    const result = itemsToOutline('all' /* mode */, outlineItems);
    expect(result).toEqual(expectedResult);
  });
});
