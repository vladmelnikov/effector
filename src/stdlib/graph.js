//@flow

import type {Graph, Graphite, Cmd} from './index.h'

export const createNode = (...node: Array<Cmd>): Graph<> => createGraph({node})

//eslint-disable-next-line no-unused-vars
declare export function createGraph(opts: {|
  +node: Array<Cmd>,
  +child?: Array<Graph<any>>,
  +from?: Array<Graph<any>>,
|}): Graph<>
declare export function createGraph<Val: {[name: string]: any}>(opts: {|
  +node: Array<Cmd>,
  +child?: Array<Graph<any>>,
  +from?: Array<Graph<any>>,
  +val: Val,
|}): Graph<Val>
export function createGraph({
  node,
  child = [],
  from = [],
  val = {},
}: {
  +node: Array<Cmd>,
  +child?: Array<Graph<any>>,
  +from?: Array<Graph<any>>,
  val?: {[name: string]: any},
}): Graph<any> {
  return {
    from,
    seq: node,
    next: child,
    val,
  }
}
export const clearNode = (
  graphite: Graphite,
  {deep}: {deep?: boolean} = {},
) => {
  const graph = getGraph(graphite)
  if (deep) {
    graph.next.forEach(node => clearNode(node, {deep}))
  }
  graph.from.forEach(node => {
    const index = node.next.indexOf(graph)
    if (index === -1) return
    node.next.splice(index, 1)
  })
  graph.from.length = 0
  graph.next.length = 0
}

export const getGraph = (graph: Graphite): Graph<any> =>
  (graph: any).graphite ?? graph
