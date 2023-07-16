package org.lib.ldests.solid

import org.lib.ldests.core.Publisher
import org.lib.ldests.rdf.RDFBuilder
import org.lib.ldests.rdf.TripleProvider

class SolidPublisher(
    url: String
): Publisher() {

    override val context = RDFBuilder.Context(
        path = url
    )

    private val connection = SolidConnection(url = url)

    override suspend fun fetch(path: String): TripleProvider {
        return connection.fromUrl("${context.path}/$path").read()
    }

    override fun publish(path: String, data: RDFBuilder.() -> Unit) {
        // TODO: keep the data callback somewhere "safe" so it can be reused if this call fails due to lacking
        //  authentication or other (temporary) failures, while dropping the data upon success or irrecoverable failure
        connection.fromUrl("${context.path}/$path").write(block = data)
    }

    override suspend fun flush() {
        connection.flush()
    }

}
