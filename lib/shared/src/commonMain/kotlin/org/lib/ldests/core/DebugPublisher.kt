package org.lib.ldests.core

import org.lib.ldests.rdf.RDFBuilder
import org.lib.ldests.rdf.TripleProvider
import org.lib.ldests.rdf.Turtle
import org.lib.ldests.rdf.ontology.Ontology
import org.lib.ldests.util.log

class DebugPublisher: Publisher() {

    override val context = RDFBuilder.Context(
        path = "debug.local"
    )

    override suspend fun fetch(path: String): TripleProvider? {
        // no compat checking relevant here
        return null
    }

    override fun publish(path: String, data: RDFBuilder.() -> Unit) {
        val str = Turtle(
            context = context,
            prefixes = Ontology.PREFIXES,
            block = data
        )
        log("In debugger for `$path`:\n$str")
    }

}
