/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict
 * @format
 */

type Rect = {
  left: number,
  right: number,
  top: number,
  bottom: number,
};

type Point = {
  x: number,
  y: number,
};

export default function rectContainsPoint(rect: Rect, point: Point): boolean {
  return (
    point.x >= rect.left &&
    point.y >= rect.top &&
    point.x <= rect.right &&
    point.y <= rect.bottom
  );
}
