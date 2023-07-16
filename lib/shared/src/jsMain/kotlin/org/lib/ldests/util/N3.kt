package org.lib.ldests.util

import org.lib.ldests.lib.rdf.N3StreamParser
import org.lib.ldests.lib.rdf.N3Triple

/**
 * Maps an input stream of the text representation of triples to actual triples
 */
actual fun InputStream<String>.mapToTriples(): InputStream<N3Triple> {
    val parser =  N3StreamParser()
    pipe(parser)
    return parser
}
