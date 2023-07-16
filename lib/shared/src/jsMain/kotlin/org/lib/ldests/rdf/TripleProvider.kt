package org.lib.ldests.rdf

import org.lib.ldests.lib.node.createReadFileStream
import org.lib.ldests.lib.rdf.IncremunicaStreamingStore
import org.lib.ldests.lib.rdf.N3Store
import org.lib.ldests.lib.rdf.N3Triple
import org.lib.ldests.util.InputStream
import org.lib.ldests.util.join
import org.lib.ldests.util.log
import org.lib.ldests.util.mapToTriples

actual sealed interface TripleProvider

actual class LocalResource private constructor(
    actual val data: TripleStore
): TripleProvider {

    actual companion object {

        actual suspend fun from(filepath: String) = LocalResource(
            data = run {
                log("Reading from `$filepath` to get local triples!")
                val store = N3Store()
                createReadFileStream(filepath)
                    .mapToTriples()
                    .on("data") { triple: N3Triple -> store.add(triple) }
                    .join()
                log("LocalResource", "Read ${store.size} triples!")
                TripleStore(store)
            }
        )

        actual fun wrap(buffer: TripleStore) = LocalResource(data = buffer)

    }

}

actual class StreamingResource actual constructor(): TripleProvider {

    internal val stream = IncremunicaStreamingStore()

    actual fun add(stream: InputStream<Triple>) {
        this.stream.import(stream)
    }

    actual fun stop() {
        stream.end()
    }

}
