import logging
from typing import Any

logger = logging.getLogger(__name__)

_run = None


def init_wandb(project: str = "quantbrief", api_key: str = ""):
    global _run
    if not api_key:
        logger.info("W&B API key not set, logging disabled")
        return
    try:
        import wandb
        _run = wandb.init(project=project, reinit=True)
        logger.info("W&B initialized: %s", _run.url)
    except Exception as e:
        logger.warning("W&B init failed: %s", e)


def log_metrics(metrics: dict[str, Any], step: int | None = None):
    if _run is None:
        return
    try:
        import wandb
        wandb.log(metrics, step=step)
    except Exception as e:
        logger.warning("W&B log failed: %s", e)


def log_agent_call(
    agent_name: str,
    model: str,
    input_tokens: int = 0,
    output_tokens: int = 0,
    latency_ms: float = 0,
    success: bool = True,
):
    log_metrics({
        f"{agent_name}/model": model,
        f"{agent_name}/input_tokens": input_tokens,
        f"{agent_name}/output_tokens": output_tokens,
        f"{agent_name}/latency_ms": latency_ms,
        f"{agent_name}/success": int(success),
    })


def finish():
    global _run
    if _run is not None:
        try:
            import wandb
            wandb.finish()
        except Exception:
            pass
        _run = None
