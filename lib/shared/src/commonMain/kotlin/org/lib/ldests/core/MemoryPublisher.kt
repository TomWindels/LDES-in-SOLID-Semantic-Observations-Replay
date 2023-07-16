package org.lib.ldests.core

import org.lib.ldests.rdf.RDFBuilder
import org.lib.ldests.rdf.TripleProvider
import org.lib.ldests.rdf.TripleStore

class MemoryPublisher: Publisher() {

    override val context = RDFBuilder.Context(
        path = ""
    )

    val buffer = TripleStore()

    override suspend fun fetch(path: String): TripleProvider? {
        // FIXME: search for all subjects starting with path... somehow
        return null
    }

    override fun publish(path: String, data: RDFBuilder.() -> Unit) {
        buffer.insert(context = RDFBuilder.Context(path = path), block = data)
    }

}
