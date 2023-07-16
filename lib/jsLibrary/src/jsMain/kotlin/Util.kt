
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.DelicateCoroutinesApi
import kotlinx.coroutines.GlobalScope
import kotlinx.coroutines.promise
import org.lib.ldests.util.LogLevel
import org.lib.ldests.util.logLevel
import kotlin.js.Promise

/**
 * Used to mark `JSExport`-ed items as being used externally, so the IDE doesn't warn about these symbols
 *  being unused
 */
annotation class ExternalUse;

@OptIn(DelicateCoroutinesApi::class)
inline fun <T> promise(
    scope: CoroutineScope = GlobalScope,
    crossinline block: suspend () -> T
): Promise<T> {
    return scope.promise { block() }
}

// helper alias to make types recognizable for JS export
inline fun <T> Collection<T>.arr() = toTypedArray()

inline fun <R, reified T> List<R>.map(transform: (R) -> T) = Array(size) { transform(this[it]) }

/** The application-wide logger **/


@JsExport
@ExternalUse
object Logger {

    @ExternalUse
    enum class Severity {
        Log, Warn, Error
    }

    @ExternalUse
    fun setLogLevel(level: Severity) {
        logLevel = LogLevel.entries[level.ordinal]
    }

    @ExternalUse
    fun log(name: String, message: String) {
        org.lib.ldests.util.log(location = name, text = message)
    }

    @ExternalUse
    fun warn(name: String, message: String) {
        org.lib.ldests.util.warn(location = name, text = message)
    }

    @ExternalUse
    fun error(name: String, message: String) {
        org.lib.ldests.util.error(location = name, text = message)
    }

}
