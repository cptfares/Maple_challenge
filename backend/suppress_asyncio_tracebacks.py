import sys
import warnings

# Suppress asyncio NotImplementedError tracebacks for Playwright on Windows
if sys.platform.startswith('win'):
    import asyncio
    def custom_exception_handler(loop, context):
        exception = context.get('exception')
        if exception and isinstance(exception, NotImplementedError):
            # Suppress NotImplementedError tracebacks
            return
        loop.default_exception_handler(context)
    asyncio.get_event_loop().set_exception_handler(custom_exception_handler)
