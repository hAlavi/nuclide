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

import type {ResolvedTunnel, Tunnel} from 'nuclide-adb/lib/types';
import type {Store} from './types';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {Observable} from 'rxjs';
import shallowEqual from 'shallowequal';
import {resolveTunnel} from './Normalization';
import * as Actions from './redux/Actions';

export function createObservableForTunnels(
  tunnels: Array<Tunnel>,
  store: Store,
): Observable<Array<ResolvedTunnel>> {
  const observables = tunnels.map(t => createObservableForTunnel(t, store));
  const highOrder = Observable.from(observables);
  return highOrder.combineAll();
}

export function createObservableForTunnel(
  tunnel: Tunnel,
  store: Store,
): Observable<ResolvedTunnel> {
  return Observable.defer(() => resolveTunnel(tunnel)).concatMap(resolved => {
    if (shallowEqual(resolved.from, resolved.to)) {
      // Identical source/destination tunnels are always immediately ready, never close.
      // Makes it easy for users to call this function without branching on whether they need to.
      return Observable.of(resolved).concat(Observable.never());
    }

    return Observable.create(observer => {
      const subscription = {
        description: tunnel.description,
        onTunnelClose: error => {
          if (error == null) {
            observer.complete();
          } else {
            observer.error(error);
          }
        },
      };
      store.dispatch(
        Actions.subscribeToTunnel(subscription, resolved, error => {
          if (error == null) {
            observer.next(resolved);
          } else {
            observer.error(error);
          }
        }),
      );

      return new UniversalDisposable(() =>
        store.dispatch(Actions.unsubscribeFromTunnel(subscription, resolved)),
      );
    });
  });
}
