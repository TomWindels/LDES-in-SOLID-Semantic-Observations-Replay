package org.lib.ldests.rdf.ontology

import org.lib.ldests.rdf.asNamedNode

object SHAPETS: Ontology {

    override val prefix = "shts"
    override val base_uri = "https://anonymised.domain.org/shape#"

    val Type = "${base_uri}BaseShape".asNamedNode()
    val Identifier = "${base_uri}SampleIdentifier".asNamedNode()
    val Constant = "${base_uri}SampleConstant".asNamedNode()
    val Variable = "${base_uri}SampleVariable".asNamedNode()

    val startIndex = "${base_uri}startIndex".asNamedNode()
    val endIndex = "${base_uri}endIndex".asNamedNode()
    val constantValues = "${base_uri}values".asNamedNode()
    val constantValue = "${base_uri}value".asNamedNode()

}
