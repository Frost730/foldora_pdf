import gc
import logging

logger = logging.getLogger("foldora.memory")


def free_memory() -> None:
    """
    Force Python garbage collection and release free memory back to the OS.
    On Linux containers (Debian/Render), calls glibc malloc_trim(0) to immediately
    return freed heap pages to the kernel, preventing 512MB OOM kills.
    """
    try:
        gc.collect()
        import ctypes
        ctypes.CDLL("libc.so.6").malloc_trim(0)
    except Exception:
        pass
