package org.lib.ldests.core

import org.lib.ldests.rdf.LocalResource
import org.lib.ldests.rdf.NamedNodeTerm
import org.lib.ldests.rdf.Triple
import org.lib.ldests.rdf.TripleStore
import org.lib.ldests.util.log
import org.lib.ldests.util.warn
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

class LDESTS private constructor(
    /** The stream itself, constructed outside of the LDESTS as this is an async operation **/
    private val stream: Stream,
    /** Active publishers, all listening to the stream **/
    val publishers: List<Publisher>,
    /** Stream buffer, already attached **/
    private val buffer: PublishBuffer
) {

    // lock used to guarantee that `flush`ing only occurs when there are no additions being made,
    //  and additions are never overlapping
    private val lock = Mutex()

    suspend fun init() {
        publishers.forEach { it.subscribe(buffer) }
        log("Flushing publishers for the first time")
        buffer.flush()
    }

    suspend fun append(filename: String) {
        log("Acquiring lock to insert data from file into the stream")
        lock.withLock {
            with (stream) {
                log("Appending data from file `$filename`")
                LocalResource.from(filepath = filename).insert()
            }
        }
    }

    /**
     * Inserts data as a streaming input source
     */
    fun insert(data: Triple) {
        warn("`insert(Triple)`: This method is currently not implemented. Data has not been added")
//        input.add(data.streamify())
    }

    /**
     * Inserts multiple data entries as a streaming input source
     */
    fun insert(data: Iterable<Triple>) {
        warn("`insert(Iterable<Triple>)`: This method is currently not implemented. Data has not been added")
//        input.add(data.streamify())
    }

    /**
     * Inserts an entire chunk of data as a standalone "file" to the stream
     */
    suspend fun add(data: TripleStore) = with (stream) {
        log("Acquiring lock to insert data as a store into the stream")
        lock.withLock {
            LocalResource.wrap(data).insert()
        }
    }

    suspend fun query(
        publisher: Publisher,
        constraints: Map<NamedNodeTerm, Iterable<NamedNodeTerm>>,
        range: LongRange = 0 until Long.MAX_VALUE
    ): Flow<Triple> {
        // TODO: require a compatibility check similar to onAttach
        log("Executing a query for `${publisher::class.simpleName}` with ${constraints.size} constraint(s) and time range ${range.first} - ${range.last}")
        return stream.query(publisher, constraints, range)
    }

    suspend fun flush() {
        log("Acquiring the lock prior to flushing the data")
        lock.withLock {
            log("Flushing stream data")
            stream.flush()
            log("Flushing all attached publishers")
            buffer.flush()
        }
    }

    suspend fun close() {
        warn("Close called, waiting until the last job has finished")
        lock.withLock {
            warn("Close: stopping all publishers.")
            publishers.forEach { it.close() }
            log("Stream has been closed.")
        }
    }

    class Builder(
        private val name: String
    ) {

        private var configuration = Stream.Configuration()
        private var shape: Shape? = null
        private val queryUris = mutableListOf<NamedNodeTerm>()
        private val publishers = mutableListOf<Publisher>()

        fun file(filepath: String): Builder {
            /* TODO: derive shape using the triples read from this filepath if necessary instead */
            // TODO offload ^ to LDESTS itself, not builder
            return this
        }

        fun stream(ldesUrl: String): Builder {
            /* TODO: derive shape using the triples read from this stream if necessary instead */
            // TODO offload ^ to LDESTS itself, not builder
            TODO()
        }

        fun remote(url: String): Builder {
            /* TODO: derive shape using the triples read from this remote resource if necessary instead */
            // TODO offload ^ to LDESTS itself, not builder
            return this
        }

        fun shape(shape: Shape): Builder {
            // setting it no matter what
            this.shape = shape
            return this
        }

        fun queryRule(uri: NamedNodeTerm): Builder {
            this.queryUris.add(uri)
            return this
        }

        fun config(configuration: Stream.Configuration): Builder {
            this.configuration = configuration
            return this
        }

        fun attach(publisher: Publisher): Builder {
            publishers.add(publisher)
            return this
        }

        suspend fun build(): LDESTS = shape?.let {
            val stream = Stream.create(
                name = name,
                configuration = configuration,
                shape = it,
                rules = it.split(*queryUris.toTypedArray())
            )
            val buf = PublishBuffer()
            stream.attach(buf)
            LDESTS(
                stream = stream,
                publishers = publishers,
                buffer = buf
            ).apply { init() }
        } ?: throw Error("Invalid Builder() usage!")

    }

}