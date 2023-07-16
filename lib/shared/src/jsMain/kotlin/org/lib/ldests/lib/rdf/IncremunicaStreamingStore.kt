@file:JsModule("ldests_compat")

package org.lib.ldests.lib.rdf

import org.lib.ldests.lib.node.ReadableNodeStream

@JsName("StreamingStore")
external class IncremunicaStreamingStore() {

    fun import(stream: ReadableNodeStream<N3Triple>)

    fun end()

}
