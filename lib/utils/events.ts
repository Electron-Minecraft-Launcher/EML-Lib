/**
 * @license MIT
 * @copyright Copyright (c) 2026, GoldFrite
 */

import { EventEmitter as EM } from 'node:events'

type DefaultEventMap = [never]
type EventMap<T> = Record<keyof T, any[]>
type Key<K, T> = T extends DefaultEventMap ? string | symbol : K | keyof T
type Listener1<K, T> = Listener<K, T, (...args: any[]) => void>
type Listener<K, T, F> = T extends DefaultEventMap ? F : K extends keyof T ? (T[K] extends unknown[] ? (...args: T[K]) => void : never) : never
type Args<K, T> = T extends DefaultEventMap ? AnyRest : K extends keyof T ? T[K] : never
type AnyRest = [...args: any[]]

export default class EventEmitter<T extends EventMap<T>> {
  private readonly emitter: EM<T>

  constructor() {
    this.emitter = new EM<T>()
  }

  /**
   * Add a listener for the given event.
   * @param eventName The name of the event.
   * @param listener The callback function.
   * @returns This EventEmitter instance.
   */
  on<K>(eventName: Key<K, T>, listener: Listener1<K, T>) {
    this.emitter.on(eventName as string | symbol, listener)
    return this
  }

  /**
   * Forward all events emitted by this EventEmitter to another EventEmitter.
   * @param target The target EventEmitter to forward events to (usually `this`).
   */
  forwardEvents<U extends EventMap<U>>(target: EventEmitter<T & U>) {
    const originalEmit = this.emit
    this.emit = (event, ...args) => {
      target.emit(event, ...(args as any))
      return originalEmit.apply(this, [event, ...args])
    }
  }

  /**
   * Emit an event with the given arguments.
   * @param eventName The name of the event.
   * @param args The arguments to pass to the listeners.
   * @returns `true` if the event had listeners, `false` otherwise.
   */
  protected emit<K>(eventName: Key<K, T>, ...args: Args<K, T>) {
    return this.emitter.emit(eventName as string | symbol, ...(args as any))
  }
}

