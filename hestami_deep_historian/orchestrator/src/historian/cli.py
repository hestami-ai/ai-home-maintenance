"""
CLI entry point for the Historian Agent Platform.

Provides commands for running verification, checking service health,
and managing the system.
"""

import asyncio
from pathlib import Path
from typing import Annotated

import structlog
import typer
from rich.console import Console
from rich.table import Table

from historian import __version__
from historian.config import get_settings
from historian.services import DoltClient, PageIndexClient, VLLMClient

app = typer.Typer(
    name="historian",
    help="Historian Agent Platform - Proposal Verification System",
    no_args_is_help=True,
)
console = Console()
logger = structlog.get_logger()


@app.command()
def version():
    """Show version information."""
    console.print(f"Historian Agent Platform v{__version__}")


@app.command()
def health():
    """Check health of all dependent services."""
    asyncio.run(_health_check())


async def _health_check():
    """Async health check implementation."""
    settings = get_settings()
    table = Table(title="Service Health")
    table.add_column("Service", style="cyan")
    table.add_column("Status", style="bold")
    table.add_column("Details")

    # Check vLLM
    vllm = VLLMClient()
    vllm_ok = await vllm.health_check()
    table.add_row(
        "vLLM",
        "[green]OK[/green]" if vllm_ok else "[red]FAIL[/red]",
        settings.vllm.url,
    )

    # Check PageIndex
    pageindex = PageIndexClient()
    try:
        pageindex_ok = await pageindex.health_check()
    except Exception:
        pageindex_ok = False
    finally:
        await pageindex.close()
    table.add_row(
        "PageIndex",
        "[green]OK[/green]" if pageindex_ok else "[red]FAIL[/red]",
        settings.pageindex.url,
    )

    # Check Dolt
    dolt = DoltClient()
    try:
        dolt_ok = await dolt.health_check()
    except Exception:
        dolt_ok = False
    finally:
        await dolt.close()
    table.add_row(
        "Dolt",
        "[green]OK[/green]" if dolt_ok else "[red]FAIL[/red]",
        f"{settings.dolt.host}:{settings.dolt.port}",
    )

    console.print(table)

    if not all([vllm_ok, pageindex_ok, dolt_ok]):
        raise typer.Exit(1)


@app.command()
def verify(
    proposal: Annotated[
        Path,
        typer.Argument(help="Path to proposal file to verify"),
    ],
    output: Annotated[
        Path | None,
        typer.Option("--output", "-o", help="Output path for judgment"),
    ] = None,
    verbose: Annotated[
        bool,
        typer.Option("--verbose", "-v", help="Enable verbose logging"),
    ] = False,
):
    """
    Verify a proposal against specifications.

    Runs the full Historian verification workflow and outputs a Judgment.
    """
    if verbose:
        structlog.configure(
            wrapper_class=structlog.make_filtering_bound_logger(10),  # DEBUG
        )

    console.print(f"[cyan]Verifying proposal:[/cyan] {proposal}")

    if not proposal.exists():
        console.print(f"[red]Error:[/red] Proposal file not found: {proposal}")
        raise typer.Exit(1)

    # TODO: Implement full verification workflow in Phase 1+
    # For now, just validate the file exists and show scaffold
    console.print("[yellow]Verification workflow not yet implemented (Phase 0)[/yellow]")
    console.print("Run 'historian health' to verify service connectivity.")


@app.command()
def serve(
    host: Annotated[str, typer.Option(help="Host to bind")] = "0.0.0.0",
    port: Annotated[int, typer.Option(help="Port to bind")] = 8080,
):
    """
    Start the orchestrator as an API server.

    Listens for proposal verification requests.
    """
    import uvicorn
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse

    # Minimal FastAPI app for Phase 0 - health endpoint only
    api = FastAPI(
        title="Historian Agent Platform",
        description="Phase 0 - Minimal health endpoint",
        version=__version__,
    )

    @api.get("/health")
    async def health_endpoint():
        """Health check endpoint for container orchestration."""
        return JSONResponse({"status": "ok", "phase": "0", "version": __version__})

    @api.get("/")
    async def root():
        """Root endpoint."""
        return JSONResponse({
            "service": "Historian Agent Platform",
            "version": __version__,
            "phase": "0",
            "status": "Phase 0 scaffold - full API coming in later phases",
        })

    console.print(f"[cyan]Starting Historian API server on {host}:{port}[/cyan]")
    console.print("[yellow]Phase 0 - Minimal health endpoint only[/yellow]")
    uvicorn.run(api, host=host, port=port, log_level="info")


@app.command()
def config():
    """Show current configuration."""
    settings = get_settings()

    table = Table(title="Configuration")
    table.add_column("Section", style="cyan")
    table.add_column("Setting", style="bold")
    table.add_column("Value")

    # vLLM settings
    table.add_row("vLLM", "URL", settings.vllm.url)
    table.add_row("vLLM", "Model", settings.vllm.model)
    table.add_row("vLLM", "Temperature", str(settings.vllm.temperature))

    # PageIndex settings
    table.add_row("PageIndex", "URL", settings.pageindex.url)
    table.add_row("PageIndex", "Docs Dir", settings.pageindex.docs_dir)

    # Dolt settings
    table.add_row("Dolt", "Host", f"{settings.dolt.host}:{settings.dolt.port}")
    table.add_row("Dolt", "Database", settings.dolt.database)

    # Orchestrator settings
    table.add_row("Orchestrator", "Coverage Threshold", str(settings.orchestrator.coverage_threshold))
    table.add_row("Orchestrator", "Degraded Mode", str(settings.orchestrator.allow_degraded_mode))
    table.add_row("Orchestrator", "Log Level", settings.orchestrator.log_level)

    console.print(table)


if __name__ == "__main__":
    app()
