package org.lib.ldests.util

import org.lib.ldests.lib.node.NodeStream
import org.lib.ldests.lib.node.ReadableNodeStream
import org.lib.ldests.lib.node.createReadFileStream
import org.lib.ldests.lib.node.finished
import org.lib.ldests.lib.rdf.N3Triple
import kotlinx.coroutines.CancellableContinuation
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

actual typealias Stream = NodeStream

actual typealias InputStream<T> = ReadableNodeStream<T>

actual suspend fun NodeStream.join() = suspendCancellableCoroutine { cont: CancellableContinuation<Unit> ->
    cont.invokeOnCancellation {
        // destroying the stream if canceled
        error("NodeStream", "A node stream has been destroyed!")
        this@join.destroy()
    }
    // alternatively, on("finish") and on("error") could be used
    finished(this@join).then(
        onFulfilled = {
            log("NodeStream", "A node stream has finished!")
            cont.resume(it)
        },
        onRejected = {
            warn("NodeStream", "A node stream `join` has been rejected!")
            cont.resumeWithException(it)
        }
    )
}

actual fun N3Triple.streamify(): ReadableNodeStream<N3Triple> =
    object: ReadableNodeStream<N3Triple>(
        options = dyn("objectMode" to true)
    ) {
        override fun read() {
            push(this@streamify)
            destroy()
        }
    }

actual fun Iterable<N3Triple>.streamify(): ReadableNodeStream<N3Triple> =
    object: ReadableNodeStream<N3Triple>(
        options = dyn("objectMode" to true)
    ) {
        override fun read() {
            this@streamify.forEach { triple -> push(triple) }
            destroy()
        }
    }

actual fun fromFile(filepath: String): InputStream<String> {
    return createReadFileStream(filepath)
}
