@file:JsModule("fs")
package org.lib.ldests.lib.node

@JsName("createReadStream")
external fun createReadFileStream(filename: String): ReadableNodeStream<String>