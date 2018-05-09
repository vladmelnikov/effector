//@flow

import invariant from 'invariant'
import {isDerivable} from './types'

import {Reactor} from './reactors'
import type {Derivation} from './derivation'
import type {Atom} from './atom'
import type {Lifecycle} from './index.h'
export type Conditions = {from: boolean, until: boolean, when: boolean}
export type Condition =
 | ((d: Derivation<*>) => boolean)
 | Atom<boolean>
 | Derivation<boolean>
 | boolean
 | void
export function reactorFabric<T>(
 Derivation: Class<Derivation<T>>,
 derivable: *,
 f: Function,
 options: *,
): () => void {
 invariant(
  typeof f === 'function',
  'the first argument to .react must be a function',
 )
 const opts: Lifecycle<T> = {once: false, skipFirst: false, ...options}

 let skipFirst = opts.skipFirst

 // wrap reactor so f doesn't get a .this context, and to allow
 // stopping after one reaction if desired.
 const reactor = new Reactor(derivable, val => {
  if (skipFirst) {
   skipFirst = false
   return
  }
  f(val)
  if (!opts.once) return
  reactor.stop()
  controller.stop()
 })

 function getCondition(condition: Condition, def: boolean) {
  if (typeof condition === 'boolean') return condition
  if (!condition) return def
  if (typeof condition === 'function') return condition(derivable)
  return condition.get()
 }
 // listen to from condition, starting the reactor controller
 // when appropriate
 const $from = assertCondition(opts.from, 'from')
 // listen to when and until conditions, starting and stopping the
 // reactor as appropriate, and stopping this controller when until
 // condition becomes true
 const $until = assertCondition(opts.until, 'until')
 const $when = assertCondition(opts.when, 'when')

 const $conds = new Derivation(() => ({
  from: getCondition($from, true),
  until: getCondition($until, false),
  when: getCondition($when, true),
 }))

 let started = false

 const controller = new Reactor($conds, (conds: Conditions) => {
  if (conds.from) {
   started = true
  }
  if (!started) return
  if (conds.until) {
   reactor.stop()
   controller.stop()
  } else if (conds.when) {
   if (!reactor._active) {
    reactor.start()
    reactor.force()
   }
  } else if (reactor._active) {
   reactor.stop()
  }
 })
 controller.start()
 controller.force()

 reactor._governor = controller
 return () => {
  reactor.stop()
  controller.stop()
 }
}

function assertCondition(condition, name) {
 if (isDerivable(condition)) {
  return condition
 }
 if (typeof condition === 'function') {
  return condition
 }
 if (typeof condition === 'undefined') {
  return condition
 }
 throw Error(
  `react ${name} condition must be derivable or function, got: ${JSON.stringify(
   condition,
  )}`,
 )
}