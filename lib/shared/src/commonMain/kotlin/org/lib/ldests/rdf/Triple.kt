package org.lib.ldests.rdf

import kotlinx.datetime.Instant
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime

expect class Triple(
    subject: Term,
    predicate: Term,
    `object`: Term
) {
    val subject: Term
    val predicate: Term
    val `object`: Term
}

expect interface Term {
    val value: String
    val type: String
}

expect interface NamedNodeTerm: Term

expect interface BlankNodeTerm: Term

expect interface LiteralTerm: Term {
    val datatype: NamedNodeTerm
}

// helpers for the methods above
expect fun String.asNamedNode(): NamedNodeTerm

expect fun String.asLiteral(): LiteralTerm

expect fun Int.asLiteral(): LiteralTerm

expect fun Long.asLiteral(): LiteralTerm

expect fun Float.asLiteral(): LiteralTerm

expect fun Double.asLiteral(): LiteralTerm

internal expect fun literal(content: String, type: NamedNodeTerm): LiteralTerm

fun Instant.asLiteral() = literal(
    content = toLocalDateTime(TimeZone.UTC).toString(),
    type = "http://www.w3.org/2001/XMLSchema#dateTime".asNamedNode()
)
