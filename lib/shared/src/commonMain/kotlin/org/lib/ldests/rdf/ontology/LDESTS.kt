package org.lib.ldests.rdf.ontology

import org.lib.ldests.rdf.asNamedNode

object LDESTS: Ontology {

    override val prefix = "ldests"
    override val base_uri = "https://anonymised.domain.org/ldests#"

    val StreamType = "${base_uri}Node".asNamedNode()
    val shape = "${base_uri}shape".asNamedNode()
    val constraintSet = "${base_uri}constraintSet".asNamedNode()
    val ConstraintSet = "${base_uri}ConstraintSet".asNamedNode()
    val Constraint = "${base_uri}Constraint".asNamedNode()
    val constraintValue = "${base_uri}constraintValue".asNamedNode()
    val constraints = "${base_uri}constraints".asNamedNode()
    val order = "${base_uri}index".asNamedNode()

    val FragmentType = "${base_uri}Fragment".asNamedNode()
    val contents = "${base_uri}contains".asNamedNode()


}
